#!/usr/bin/env python3
"""Static file server for local development.

`python -m http.server` sends Last-Modified but no Cache-Control, so Chrome
applies heuristic freshness and will happily serve a module it fetched a minute
ago — you edit a file, reload, and get the old code with no way to tell. That is
especially confusing here because the app also installs a service worker, so the
obvious suspect is the wrong one.

This is the same server with `Cache-Control: no-store` on every response.

    python dev-server.py [port]

Production hosting should do the opposite: long caching for the hashed assets and
the service worker's VERSION constant is what invalidates them.
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        # One line per request is noise when a page pulls thirty modules.
        if '404' in (fmt % args):
            super().log_message(fmt, *args)

    def handle_one_request(self):
        # A reload cancels every in-flight module request, and each one raises
        # here. The default handler prints a full traceback per abort, which
        # buries anything that actually matters.
        try:
            super().handle_one_request()
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            self.close_connection = True


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    handler = partial(NoCacheHandler, directory='.')
    # Threading, not the plain HTTPServer: this app imports ~35 ES modules on
    # load, and a single-threaded server serialises them behind any one slow or
    # aborted connection, which reads as the page hanging.
    server = ThreadingHTTPServer(('127.0.0.1', port), handler)
    server.daemon_threads = True
    print(f'Sabr dev server on http://127.0.0.1:{port} (no-store)')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nstopped')


if __name__ == '__main__':
    main()
