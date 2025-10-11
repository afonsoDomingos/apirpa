import mongoose from 'mongoose';

const replySchema = new mongoose.Schema({
  autor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  conteudo: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const postSchema = new mongoose.Schema({
  autor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  conteudo: { type: String, required: true },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' }],
  replies: [replySchema],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Post || mongoose.model('Post', postSchema);
