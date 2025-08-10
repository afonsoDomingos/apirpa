class emolaB2C {
  async payment(phone, amount) {
    // implementar a lógica aqui ou só mockar por enquanto
    return { status: 'success', data: 'Pagamento Emola B2C simulado' };
  }
}

module.exports = new emolaB2C();
