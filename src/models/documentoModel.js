const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize(process.env.DATABASE_URL);

const Documento = sequelize.define('Documento', {
  nome_completo: {
    type: DataTypes.STRING,
    allowNull: false
  },
  tipo_documento: {
    type: DataTypes.STRING,
    allowNull: false
  },
  contacto: {
    type: DataTypes.STRING, // Mudança para STRING para suportar números com espaços ou símbolos
    allowNull: false
  },
  provincia: {
    type: DataTypes.STRING,
    allowNull: false
  },
  numero_documento: {
    type: DataTypes.STRING, // Mudança para STRING, pois números de documentos podem conter letras ou símbolos
    allowNull: false,
    unique: true
  },
  data_perda: {
    type: DataTypes.DATE,
    allowNull: false
  },
  origem: { // Corrigido de 'origin' para 'origem', para manter consistência com o resto do código
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['proprietario', 'reportado']]
    }
  }
});

module.exports = { Documento, sequelize };
