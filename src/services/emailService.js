// services/emailService.js
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    // Verifica se as variáveis de ambiente estão configuradas
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('⚠️ SMTP não configurado. Emails de notificação não serão enviados.');
      return;
    }

    // LOG: Mostrar configuração atual
    console.log('\n🔧 CONFIGURAÇÃO SMTP:');
    console.log(`   SMTP_HOST: ${process.env.SMTP_HOST || 'não definido'}`);
    console.log(`   SMTP_USER: ${process.env.SMTP_USER}`);
    console.log(`   SMTP_PASS: ${process.env.SMTP_PASS ? '***configurada***' : 'não definida'}`);
    console.log(`   ADMIN_EMAIL: ${process.env.ADMIN_EMAIL || 'não definido'}`);

    // Detectar se está usando SendGrid
    const isSendGrid = process.env.SMTP_HOST?.includes('sendgrid') || process.env.SMTP_USER === 'apikey';
    console.log(`   Detectado: ${isSendGrid ? 'SENDGRID' : 'GMAIL'}\n`);

    if (isSendGrid) {
      // Configuração SendGrid
      this.transporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: {
          user: 'apikey',
          pass: process.env.SMTP_PASS // SendGrid API Key
        }
      });
      console.log('✅ Email service inicializado com SendGrid');
    } else {
      // Configuração Gmail com timeouts aumentados
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        pool: true,
        maxConnections: 5,
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
        tls: {
          rejectUnauthorized: false,
          minVersion: 'TLSv1.2'
        }
      });
      console.log('✅ Email service inicializado com Gmail');
    }
  }

  /**
   * Envia notificação de pagamento ao admin
   * @param {Object} paymentData - Dados do pagamento
   */
  async sendPaymentNotificationToAdmin(paymentData) {
    if (!this.transporter) {
      console.warn('⚠️ Transporter não configurado. Email não enviado.');
      return { success: false, error: 'SMTP não configurado' };
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.warn('⚠️ ADMIN_EMAIL não configurado.');
      return { success: false, error: 'ADMIN_EMAIL não configurado' };
    }

    try {
      const {
        pagamentoId,
        usuarioNome,
        usuarioEmail,
        valor,
        pacote,
        metodoPagamento,
        tipoPagamento,
        dataPagamento,
        referencia,
        anuncioNome
      } = paymentData;

      // Template HTML profissional
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .payment-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .detail-label { font-weight: bold; color: #667eea; }
    .detail-value { color: #333; }
    .amount { font-size: 32px; font-weight: bold; color: #10b981; text-align: center; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    .badge { display: inline-block; padding: 5px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; }
    .badge-success { background: #d1fae5; color: #065f46; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💰 Novo Pagamento Confirmado!</h1>
      <p style="margin: 0; opacity: 0.9;">RecuperaAqui - Sistema de Pagamentos</p>
    </div>
    
    <div class="content">
      <div class="payment-box">
        <div class="amount">${valor.toFixed(2)} MZN</div>
        <span class="badge badge-success">✓ APROVADO</span>
        
        <div style="margin-top: 30px;">
          <div class="detail-row">
            <span class="detail-label">Cliente:</span>
            <span class="detail-value">${usuarioNome || 'N/A'}</span>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">Email:</span>
            <span class="detail-value">${usuarioEmail || 'N/A'}</span>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">Pacote:</span>
            <span class="detail-value">${pacote.toUpperCase()}</span>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">Tipo:</span>
            <span class="detail-value">${tipoPagamento === 'assinatura' ? 'Assinatura' : 'Anúncio'}</span>
          </div>
          
          ${anuncioNome ? `
          <div class="detail-row">
            <span class="detail-label">Anúncio:</span>
            <span class="detail-value">${anuncioNome}</span>
          </div>
          ` : ''}
          
          <div class="detail-row">
            <span class="detail-label">Método:</span>
            <span class="detail-value">${metodoPagamento.toUpperCase()}</span>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">Referência:</span>
            <span class="detail-value">${referencia}</span>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">Data:</span>
            <span class="detail-value">${new Date(dataPagamento).toLocaleString('pt-MZ')}</span>
          </div>
          
          <div class="detail-row" style="border-bottom: none;">
            <span class="detail-label">ID Pagamento:</span>
            <span class="detail-value" style="font-family: monospace; font-size: 11px;">${pagamentoId}</span>
          </div>
        </div>
      </div>
      
      <div class="footer">
        <p>Esta é uma notificação automática do sistema RecuperaAqui.</p>
        <p>© ${new Date().getFullYear()} RecuperaAqui - Todos os direitos reservados</p>
      </div>
    </div>
  </div>
</body>
</html>
      `;

      // Configuração do email
      const mailOptions = {
        from: `"RecuperaAqui Pagamentos" <${process.env.SMTP_USER}>`,
        to: adminEmail,
        cc: process.env.ADMIN_EMAIL_CC || undefined,
        subject: `💰 Novo Pagamento: ${valor.toFixed(2)} MZN - ${pacote.toUpperCase()}`,
        html: htmlContent,
        text: `
NOVO PAGAMENTO CONFIRMADO

Valor: ${valor.toFixed(2)} MZN
Cliente: ${usuarioNome || 'N/A'} (${usuarioEmail || 'N/A'})
Pacote: ${pacote.toUpperCase()}
Tipo: ${tipoPagamento}
Método: ${metodoPagamento.toUpperCase()}
Referência: ${referencia}
Data: ${new Date(dataPagamento).toLocaleString('pt-MZ')}
ID: ${pagamentoId}
        `.trim()
      };

      const info = await this.transporter.sendMail(mailOptions);

      console.log('✅ Email enviado ao admin:', info.messageId);
      return { success: true, messageId: info.messageId };

    } catch (error) {
      console.error('❌ Erro ao enviar email:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Função legada para compatibilidade (SendGrid)
   * @deprecated Use sendPaymentNotificationToAdmin para notificações de pagamento
   */
  async enviarEmail(to, subject, html) {
    if (!this.transporter) {
      console.warn('⚠️ Transporter não configurado.');
      return;
    }

    try {
      const mailOptions = {
        from: `"RecuperaAqui" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html
      };

      await this.transporter.sendMail(mailOptions);
      console.log('✅ Email enviado com sucesso para:', to);
    } catch (error) {
      console.error('❌ Erro ao enviar email:', error.message);
    }
  }
}

module.exports = new EmailService();
