import json
import os
import time
import urllib.request
import urllib.error
import boto3

S3_BUCKET = os.environ['S3_BUCKET']
S3_KEY    = os.environ['S3_KEY']           # 'data/directory.json'
CF_ID     = os.environ['CF_DISTRIBUTION_ID']
CLIENT_ID = '359413044723-jcdum67h4hdgucabnml95jb6i4e1l663.apps.googleusercontent.com'

s3 = boto3.client('s3')
cf = boto3.client('cloudfront')


def lambda_handler(event, context):
    method = event.get('requestContext', {}).get('http', {}).get('method', '')
    if method == 'OPTIONS':
        return _resp(200, {})

    # --- Parse body ---
    try:
        body     = json.loads(event.get('body') or '{}')
        token    = body['token']    # Google ID JWT from browser
        new_data = body['data']     # full updated directory dict
    except (KeyError, json.JSONDecodeError):
        return _resp(400, {'error': 'Invalid request body'})

    # --- Verify Google JWT ---
    email = _verify_google_token(token)
    if not email:
        return _resp(403, {'error': 'Invalid or expired Google token'})

    # --- Load CURRENT data from S3 (admin check must be against stored truth) ---
    try:
        obj = s3.get_object(Bucket=S3_BUCKET, Key=S3_KEY)
        current_data = json.loads(obj['Body'].read().decode('utf-8'))
    except Exception as e:
        print(f'S3 GetObject error: {e}')
        return _resp(500, {'error': 'Could not read directory data'})

    # --- Verify admin status against CURRENT stored data, not submitted data ---
    admins = [a.lower().strip() for a in current_data.get('admins', [])]
    if email not in admins:
        return _resp(403, {'error': 'Not authorized — admin access required'})

    # --- Validate submitted data has minimum required structure ---
    required = {'announcements', 'admins', 'leaders', 'families'}
    if not required.issubset(new_data.keys()):
        return _resp(400, {'error': 'Submitted data missing required fields'})

    # --- Write new JSON to S3 ---
    try:
        s3.put_object(
            Bucket=S3_BUCKET,
            Key=S3_KEY,
            Body=json.dumps(new_data, indent=2, ensure_ascii=False).encode('utf-8'),
            ContentType='application/json; charset=utf-8',
        )
    except Exception as e:
        print(f'S3 PutObject error: {e}')
        return _resp(500, {'error': 'Could not save directory data'})

    # --- Invalidate CloudFront cache (non-fatal if it fails) ---
    try:
        cf.create_invalidation(
            DistributionId=CF_ID,
            InvalidationBatch={
                'Paths': {'Quantity': 1, 'Items': ['/data/directory.json']},
                'CallerReference': str(int(time.time())),
            },
        )
    except Exception as e:
        print(f'CloudFront invalidation error (non-fatal): {e}')

    return _resp(200, {'ok': True})


def _verify_google_token(token):
    """
    Call Google's tokeninfo endpoint to validate the JWT and extract the email.
    Returns lowercase email on success, None on any failure.
    Google validates signature, expiry, and audience server-side.
    """
    url = f'https://oauth2.googleapis.com/tokeninfo?id_token={token}'
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            payload = json.loads(r.read().decode('utf-8'))
        if payload.get('aud') != CLIENT_ID:
            print(f"Token audience mismatch: {payload.get('aud')}")
            return None
        email = payload.get('email', '').lower().strip()
        return email if email else None
    except urllib.error.HTTPError as e:
        print(f'tokeninfo HTTP error {e.code}: {e.read()}')
        return None
    except Exception as e:
        print(f'tokeninfo error: {e}')
        return None


def _resp(status, body):
    return {
        'statusCode': status,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        'body': json.dumps(body),
    }
