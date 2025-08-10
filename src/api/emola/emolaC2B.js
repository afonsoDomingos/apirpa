class emolaC2B {
  async payment(phone, amount) {
    // implementar a lógica aqui ou só mockar por enquanto
    return { status: 'success', data: 'Pagamento Emola C2B simulado' };
  }
}

module.exports = new emolaC2B();
