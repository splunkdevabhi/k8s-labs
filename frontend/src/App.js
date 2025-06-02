import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import {
    FitAddon
} from '@xterm/addon-fit';
import './App.css';

function App() {
    const terminalRef = useRef(null);
    const term = useRef(null);
    const ws = useRef(null);

    useEffect(() => {
        // Initialize xterm.js
        term.current = new Terminal({
            cursorBlink: true,
            rows: 30,
            cols: 80,
        });
        const fitAddon = new FitAddon();
        term.current.loadAddon(fitAddon);
        term.current.open(terminalRef.current);
        fitAddon.fit();

        // Establish WebSocket connection
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        const port = 3001; // Backend port
        ws.current = new WebSocket(`${protocol}//${host}:${port}/ws`);

        ws.current.onopen = () => {
            console.log('WebSocket connection established');
            // Send resize message on connect and on window resize
            const sendResize = () => {
                if (term.current && ws.current && ws.current.readyState === WebSocket.OPEN) {
                    const { cols, rows } = term.current;
                    ws.current.send(JSON.stringify({ type: 'resize', cols, rows }));
                }
            };
            sendResize(); 
            window.addEventListener('resize', () => {
                fitAddon.fit();
                sendResize();
            });
        };

        ws.current.onmessage = (event) => {
            term.current.write(event.data);
        };

        ws.current.onclose = () => {
            console.log('WebSocket connection closed');
            term.current.write('\r\nConnection closed.\r\n');
        };

        ws.current.onerror = (error) => {
            console.error('WebSocket error:', error);
            term.current.write(`\r\nWebSocket Error: ${error.message}\r\n`);
        };

        // Pipe user input from xterm.js to WebSocket
        term.current.onData((data) => {
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                ws.current.send(data);
            }
        });

        return () => {
            // Clean up WebSocket and xterm.js instance
            if (ws.current) {
                ws.current.close();
            }
            if (term.current) {
                term.current.dispose();
            }
            window.removeEventListener('resize', fitAddon.fit);
        };
    }, []);

    return (
        <div className="App">
            <div ref={terminalRef} style={{ width: '100%', height: '100vh' }} />
        </div>
    );
}

export default App;
