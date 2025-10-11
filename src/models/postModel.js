const mongoose = require('mongoose');

const replySchema = new mongoose.Schema(
  {
    autor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true
    },
    conteudo: {
      type: String,
      required: true,
      trim: true
    }
  },
  { timestamps: true }
);

const postSchema = new mongoose.Schema(
  {
    autor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true
    },
    conteudo: {
      type: String,
      required: true,
      trim: true
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario'
      }
    ],
    replies: [replySchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Post', postSchema);
