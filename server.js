const fastify = require('fastify')({ logger: false })
const { execFile } = require('child_process')
const { writeFileSync, unlinkSync } = require('fs')
const { randomUUID } = require('crypto')
const path = require('path')
const os = require('os')

fastify.register(require('@fastify/cors'), { origin: '*' })

fastify.post('/execute', async (req, reply) => {
  const { code } = req.body
  if (!code || typeof code !== 'string') {
    return reply.code(400).send({ error: 'Falta el código' })
  }
  if (code.length > 10000) {
    return reply.code(400).send({ error: 'Código demasiado largo' })
  }

  const id = randomUUID()
  const file = path.join(os.tmpdir(), `${id}.py`)

  try {
    writeFileSync(file, code, 'utf8')
    const output = await runPython(file)
    return reply.send({ stdout: output.stdout, stderr: output.stderr })
  } catch (e) {
    return reply.send({ stdout: '', stderr: e.message })
  } finally {
    try { unlinkSync(file) } catch {}
  }
})

function runPython(file) {
  return new Promise((resolve) => {
    execFile('python3', [file], { timeout: 8000, maxBuffer: 1024 * 64 }, (err, stdout, stderr) => {
      if (err && err.killed) {
        resolve({ stdout: '', stderr: '⏱️ Tiempo límite superado (8s).' })
      } else {
        resolve({ stdout: stdout || '', stderr: stderr || (err ? err.message : '') })
      }
    })
  })
}

fastify.get('/health', async () => ({ ok: true }))

const PORT = process.env.PORT || 4000
fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) { console.error(err); process.exit(1) }
  console.log(`Python runner en puerto ${PORT}`)
})
