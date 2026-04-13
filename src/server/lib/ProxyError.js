export class ProxyError extends Error {
  constructor(message, status = 500, payload = null) {
    super(message)
    this.name = 'ProxyError'
    this.status = status
    this.payload = payload
  }
}
