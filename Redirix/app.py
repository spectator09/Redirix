import time
from urllib.parse import urljoin
from flask import Flask, request, jsonify, render_template
import requests

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.json
    url = data.get('url', '').strip()
    if not url:
        return jsonify({'error': 'URL is required'}), 400

    if not url.startswith('http://') and not url.startswith('https://'):
        url = 'http://' + url

    chain = []
    count = 0
    total_time = 0.0
    current_url = url
    max_redirects = 10
    user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

    try:
        session = requests.Session()
        session.headers.update({'User-Agent': user_agent})

        while count < max_redirects:
            start_time = time.time()
            try:
                # Use allow_redirects=False to track manually
                response = session.get(current_url, allow_redirects=False, timeout=10)
            except requests.exceptions.RequestException as e:
                # If it's the first request and it fails, it's just a bad URL.
                # If it fails mid-chain, we return what we have so far plus the error.
                error_msg = 'Connection error or timeout'
                step = {
                    'url': current_url,
                    'status_code': 0,
                    'time_taken': round(time.time() - start_time, 3)
                }
                chain.append(step)
                return jsonify({
                    'error': f'Request failed at {current_url}: {error_msg}',
                    'chain': chain,
                    'count': count,
                    'total_time': round(total_time + step['time_taken'], 3),
                    'verdict': 2
                }), 400

            elapsed = time.time() - start_time
            total_time += elapsed
            status_code = response.status_code

            step = {
                'url': current_url,
                'status_code': status_code,
                'time_taken': round(elapsed, 3)
            }
            chain.append(step)

            if response.is_redirect or response.is_permanent_redirect or status_code in (301, 302, 303, 307, 308):
                location = response.headers.get('Location')
                if not location:
                    break
                
                # Handle relative redirects by joining with current_url
                next_url = urljoin(current_url, location)
                current_url = next_url
                count += 1
            else:
                break
        
        if count >= max_redirects:
            return jsonify({
                'error': 'Too many redirects (stopped at 10)',
                'chain': chain,
                'count': count,
                'total_time': round(total_time, 3),
                'verdict': 2
            }), 400

        if count == 0:
            verdict = 0
        elif 1 <= count <= 2:
            verdict = 1
        else:
            verdict = 2

        return jsonify({
            'count': count,
            'chain': chain,
            'total_time': round(total_time, 3),
            'verdict': verdict
        })

    except Exception as e:
        return jsonify({'error': f'An unexpected error occurred: {str(e)}'}), 500
if __name__ == '__main__':
    app.run()
