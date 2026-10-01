import http.server, socketserver, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        self.send_header('Access-Control-Allow-Origin','*')
        self.send_header('X-Frame-Options','ALLOWALL')
        super().end_headers()
    def log_message(self,f,*a):pass
class S(socketserver.ThreadingTCPServer):
    allow_reuse_address=True; daemon_threads=True
S(("0.0.0.0",8080),H).serve_forever()
