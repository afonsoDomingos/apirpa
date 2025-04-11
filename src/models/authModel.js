const { Sequelize, DataTypes } = require('sequelize');

// Conectando ao banco de dados
const sequelize = new Sequelize('database', 'user', 'password', {
  host: 'localhost',
  dialect: 'mysql' // Pode ser 'postgres', 'sqlite' ou 'mssql'
});

// Definição do modelo (tabela 'Users')
const User = sequelize.define('User', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    unique: true
  }
});

// Sincronizar modelo com o banco de dados
sequelize.sync()
  .then(() => console.log("Banco de dados sincronizado"))
  .catch(err => console.error("Erro ao sincronizar:", err));

