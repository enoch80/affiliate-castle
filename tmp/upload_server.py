import http.server
import cgi
import os
import html
import pathlib
import time

SAVE_DIR = '/tmp/screenshots'
pathlib.Path(SAVE_DIR).mkdir(exist_ok=True)

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send_page(self, extra=''):
        files = sorted(pathlib.Path(SAVE_DIR).iterdir(), key=os.path.getmtime, reverse=True)
        list_html = ''.join(
            f'<li><a href="/img/{p.name}">{html.escape(p.name)}</a> ({p.stat().st_size} bytes)</li>'
            for p in files
        )
        body = f"""<!doctype html>
<html><head><meta charset=utf-8><title>Screenshot Upload</title>
<style>
  body{{font-family:sans-serif;max-width:520px;margin:40px auto;padding:20px;background:#111;color:#eee}}
  h2{{color:#D97706;margin-bottom:4px}}
  p{{font-size:12px;color:#888;margin-top:0}}
  input[type=file]{{display:block;margin:10px 0;padding:8px;border-radius:6px;border:1px solid #555;background:#222;color:#eee;width:100%;box-sizing:border-box}}
  input[type=submit]{{padding:10px 20px;border-radius:6px;border:none;background:#D97706;color:#fff;font-weight:700;cursor:pointer;font-size:14px}}
  ul{{padding-left:20px}}
  a{{color:#D97706}}
  .ok{{color:#86efac;font-weight:700}}
</style>
</head><body>
<h2>Screenshot Upload</h2>
<p>Upload a screenshot and Copilot will fetch it via SSH.</p>
{extra}
<form method="POST" action="/upload" enctype="multipart/form-data">
  <input type="file" name="file" accept="image/*">
  <input type="submit" value="Upload Screenshot">
</form>
<h3>Uploaded files:</h3>
<ul>{list_html if list_html else '<li>None yet</li>'}</ul>
</body></html>"""
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(body.encode())

    def serve_image(self, name):
        safe = pathlib.Path(name).name  # strip any path traversal
        path = pathlib.Path(SAVE_DIR) / safe
        if not path.exists() or not path.is_file():
            self.send_error(404)
            return
        ext = path.suffix.lower()
        mime = {'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
                'gif': 'image/gif', 'webp': 'image/webp'}.get(ext.lstrip('.'), 'application/octet-stream')
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(path.stat().st_size))
        self.end_headers()
        self.wfile.write(path.read_bytes())

    def do_GET(self):
        if self.path.startswith('/img/'):
            self.serve_image(self.path[5:])
        else:
            self.send_page()

    def do_POST(self):
        if self.path != '/upload':
            self.send_error(404)
            return
        ctype, pdict = cgi.parse_header(self.headers.get('Content-Type', ''))
        if ctype != 'multipart/form-data':
            self.send_error(400)
            return
        pdict['boundary'] = pdict['boundary'].encode()
        fields = cgi.parse_multipart(self.rfile, pdict)
        data = fields.get('file', [None])[0]
        if not data:
            self.send_page('<p class="ok">No file received.</p>')
            return
        # Build safe filename
        raw_name = 'screenshot.png'
        safe_name = f'{int(time.time())}_{pathlib.Path(raw_name).name}'
        out = pathlib.Path(SAVE_DIR) / safe_name
        out.write_bytes(data if isinstance(data, bytes) else data.encode())
        print(f'SAVED: {out}', flush=True)
        self.send_response(303)
        self.send_header('Location', '/')
        self.end_headers()

if __name__ == '__main__':
    server = http.server.HTTPServer(('0.0.0.0', 9090), Handler)
    print('Upload server running on http://109.199.106.147:9090', flush=True)
    server.serve_forever()
