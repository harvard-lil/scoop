# ABOUT "MIRROR" STREAMS

This library creates a "mirror" stream for the client socket as well as the server socket, through which the chunks they receive are piped and subsequently buffered. This buffering allows Node's http parsing facilities to consume the original stream to parse the headers once enough chunks have arrived (because headers can be chunked!) while allowing us, once we have the parsed IncomingMessage, to consume the mirror and pass those chunks on to their destination. Without this buffering, we would no longer have access to the chunks containing the headers at the point that Node triggers the 'request' and 'response' events.

For more on this buffering, see https://nodejs.org/api/stream.html#buffering
