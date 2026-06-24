const fastify = require('fastify')({ logger: false })
const { execFile } = require('child_process')
const { writeFileSync, unlinkSync } = require('fs')
const { randomUUID } = require('crypto')
const path = require('path')
const os = require('os')

fastify.addHook('onRequest', (req, reply, done) => {
  reply.header('Access-Control-Allow-Origin', '*')
  reply.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  reply.header('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { reply.code(204).send(); return }
  done()
})

fastify.post('/execute', async (req, reply) => {
  const { code, stdin = '' } = req.body
  if (!code || typeof code !== 'string') return reply.code(400).send({ error: 'Falta el código' })
  if (code.length > 10000) return reply.code(400).send({ error: 'Código demasiado largo' })

  const file = path.join(os.tmpdir(), `${randomUUID()}.py`)
  try {
    writeFileSync(file, code, 'utf8')
    const result = await runPython(file, stdin)
    return reply.send(result)
  } catch (e) {
    return reply.send({ stdout: '', stderr: e.message })
  } finally {
    try { unlinkSync(file) } catch {}
  }
})

function runPython(file, stdin) {
  return new Promise((resolve) => {
    const proc = execFile(
      'python3', ['-u', file],
      { timeout: 10000, maxBuffer: 1024 * 64 },
      (err, stdout, stderr) => {
        if (err && err.killed) {
          resolve({ stdout, stderr: '⏱️ Tiempo límite superado (10s).' })
        } else {
          resolve({ stdout: stdout || '', stderr: stderr || (err ? err.message : '') })
        }
      }
    )
    // Pasar stdin si existe
    if (stdin && stdin.trim()) {
      const stdinFinal = stdin.endsWith('\n') ? stdin : stdin + '\n'
      proc.stdin.write(stdinFinal)
    }
    proc.stdin.end()
  })
}

fastify.get('/health', async () => ({ ok: true }))

fastify.listen({ port: 4000, host: '0.0.0.0' }, (err) => {
  if (err) { console.error(err); process.exit(1) }
  console.log('Python runner en puerto 4000')
})
