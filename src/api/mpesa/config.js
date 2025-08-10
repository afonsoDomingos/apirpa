const fs = require('fs');
const path = require('path');

class Config {
  constructor() {
    this.apiKey = process.env.MPESA_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('MPESA_API_KEY não está definida nas variáveis de ambiente Rpa');
    }

    this.publicKey = fs.readFileSync(path.join(__dirname, 'mpesa_public.pem'), 'utf8');
    this.serviceProviderCode = process.env.MPESA_SERVICE_PROVIDER_CODE || '171717';
  }
}

module.exports = new Config();
