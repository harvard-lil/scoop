const [mode, ...args] = process.argv.slice(2)

if (mode === 'args') {
  process.stdout.write(JSON.stringify(args))
} else if (mode === 'stdin') {
  const chunks = []
  process.stdin.on('data', chunk => chunks.push(chunk))
  process.stdin.on('end', () => {
    const input = Buffer.concat(chunks)
    process.stdout.write(JSON.stringify({ length: input.length, text: input.toString() }))
  })
} else if (mode === 'exit') {
  process.stdout.write('standard output')
  process.stderr.write('standard error')
  process.exit(7)
} else if (mode === 'output') {
  process.stdout.write(args[0])
} else if (mode === 'hang') {
  setInterval(() => {}, 1000)
}
