import React, { useRef, useEffect, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { ResizableBox } from 'react-resizable';
import '@xterm/xterm/css/xterm.css';
import 'react-resizable/css/styles.css';
import './Terminal.css';

const WEBSOCKET_URL = process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:3001';
const RECONNECT_INTERVAL = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

const Terminal = ({ title = 'K8s Terminal' }) => {
  // Refs for DOM elements and objects
  const terminalRef = useRef(null);
  const termRef = useRef(null);
  const fitAddonRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const sessionIdRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);

  // Component state
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);

  // Initialize terminal
  useEffect(() => {
    // Create terminal instance
    const term = new XTerm({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      theme: {
        background: '#1e1e1e',
        foreground: '#f0f0f0',
        cursor: '#f0f0f0',
        cursorAccent: '#1e1e1e',
        selection: 'rgba(255, 255, 255, 0.3)',
      },
    });

    // Create and load fit addon
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    // Create and load web links addon
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(webLinksAddon);

    // Open terminal in container
    term.open(terminalRef.current);
    fitAddon.fit();

    // Display a welcome message
    term.writeln('\x1b[1;34m┌──────────────────────────────────────────┐');
    term.writeln('│ Welcome to the Kubernetes Terminal       │');
    term.writeln('│ Connecting to the server...              │');
    term.writeln('└──────────────────────────────────────────┘\x1b[0m');

    // Store references
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle user input
    term.onData((data) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // Handle terminal resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        const { cols, rows } = termRef.current;

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
        }
      }
    };

    // Add event listeners
    window.addEventListener('resize', handleResize);
    
    setInitializing(false);

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      
      // Close terminal
      if (termRef.current) {
        termRef.current.dispose();
      }
      
      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      // Clear timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // Connect to WebSocket server
  const connectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const ws = new WebSocket(WEBSOCKET_URL);
      wsRef.current = ws;
      
      if (reconnecting) {
        reconnectAttemptsRef.current += 1;
      }

      ws.onopen = () => {
        setConnected(true);
        setError(null);
        setReconnecting(false);
        reconnectAttemptsRef.current = 0;
        
        if (termRef.current) {
          termRef.current.writeln('\r\n\x1b[1;32m[Connected to server]\x1b[0m\r\n');
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case 'session':
              sessionIdRef.current = message.id;
              termRef.current.writeln(`\r\n\x1b[1;33m[Session ID: ${message.id}]\x1b[0m\r\n`);
              break;
            
            case 'terminal':
              if (termRef.current) {
                termRef.current.write(message.data);
              }
              break;
              
            default:
              console.warn('Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };

      ws.onclose = (event) => {
        setConnected(false);
        
        if (termRef.current) {
          termRef.current.writeln('\r\n\x1b[1;31m[Disconnected from server]\x1b[0m\r\n');
        }
        
        // Try to reconnect if not closed intentionally and not exceeding max attempts
        if (!event.wasClean && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          setReconnecting(true);
          
          if (termRef.current) {
            termRef.current.writeln(`\x1b[1;33m[Attempting to reconnect (${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})...]\x1b[0m\r\n`);
          }
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, RECONNECT_INTERVAL);
        } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setError('Maximum reconnection attempts reached. Please try again later.');
          setReconnecting(false);
          
          if (termRef.current) {
            termRef.current.writeln('\r\n\x1b[1;31m[Maximum reconnection attempts reached. Please try again manually.]\x1b[0m\r\n');
          }
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('WebSocket connection error');
        
        if (termRef.current) {
          termRef.current.writeln(`\r\n\x1b[1;31m[Connection error: ${error.message || 'Unknown error'}]\x1b[0m\r\n`);
        }
      };
    } catch (error) {
      setError(`Failed to connect: ${error.message}`);
      setReconnecting(false);
      
      if (termRef.current) {
        termRef.current.writeln(`\r\n\x1b[1;31m[Failed to connect: ${error.message}]\x1b[0m\r\n`);
      }
    }
  };

  // Connect WebSocket when terminal is ready
  useEffect(() => {
    if (!initializing) {
      connectWebSocket();
    }
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [initializing]);

  // Handle resize events from the ResizableBox component
  const handleResizeStop = (event, { size }) => {
    if (fitAddonRef.current) {
      setTimeout(() => {
        fitAddonRef.current.fit();
        
        if (termRef.current) {
          const { cols, rows } = termRef.current;

          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
          }
        }
      }, 0);
    }
  };

  // Handle manual reconnection
  const handleManualReconnect = () => {
    setError(null);
    reconnectAttemptsRef.current = 0;
    connectWebSocket();
  };

  // Create status class based on connection state
  const statusClassName = `terminal-status ${connected ? 'connected' : 'disconnected'} ${reconnecting ? 'reconnecting' : ''}`;

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <div className="terminal-title">{title}</div>
        <div className={statusClassName}>
          {connected ? 'Connected' : reconnecting ? 'Reconnecting...' : 'Disconnected'}
        </div>
      </div>
      <ResizableBox
        width={800}
        height={400}
        minConstraints={[300, 200]}
        maxConstraints={[1200, 800]}
        className="terminal-resizable"
        onResizeStop={handleResizeStop}
      >
        <div ref={terminalRef} className="terminal" />
      </ResizableBox>
      {error && (
        <div className="terminal-error">
          <p>{error}</p>
          <button onClick={handleManualReconnect}>Reconnect</button>
        </div>
      )}
    </div>
  );
};

export default Terminal;

