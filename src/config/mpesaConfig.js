// src/config/mpesaConfig.js

module.exports = {
  environment: 'sandbox', // ou 'production' quando for para produção
  shortcode: 'SeuShortcode', // Shortcode obtido no portal da Safaricom
  lipaNaMpesaShortcode: 'SeuLipaNaMpesaShortcode', // Se for utilizar o "Lipa na M-Pesa"
  lipaNaMpesaShortcodeSecret: 'SeuSecret', // Secret para o Lipa na M-Pesa
  shortcodeSecret: 'SeuShortcodeSecret', // Secret para o shortcode
  key: 'SuaAPIKey', // Chave API obtida no portal da Safaricom
  secret: 'SuaAPISecret', // Secret API obtido no portal da Safaricom
  baseUrl: 'https://sandbox.safaricom.co.ke/mpesa/', // URL para o ambiente de testes (sandbox)
};
