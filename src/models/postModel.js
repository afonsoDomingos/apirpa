// models/postModel.js
const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  autor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  conteudo: { type: String, required: true },
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } });

const postSchema = new mongoose.Schema({
  autor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  conteudo: { type: String, required: true },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' }],
  replies: [replySchema]
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

// Virtual para contar curtidas
postSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

// Virtual para contar respostas
postSchema.virtual('replyCount').get(function() {
  return this.replies.length;
});

postSchema.set('toJSON', { virtuals: true });
postSchema.set('toObject', { virtuals: true });

module.exports = mongoose.models.Post || mongoose.model('Post', postSchema);
