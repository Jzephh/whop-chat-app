import mongoose, { Schema, models } from 'mongoose';

export interface IMessage extends mongoose.Document {
  companyId: string;
  userId: string;
  username?: string;
  content?: string;
  imageUrl?: string;
  mentions: Array<{ userId: string; username?: string }>; 
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>({
  companyId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  username: { type: String },
  content: { type: String },
  imageUrl: { type: String },
  mentions: [
    new Schema(
      {
        userId: String,
        username: String
      },
      { _id: false }
    )
  ]
}, { timestamps: { createdAt: true, updatedAt: false } });

export const Message = models.Message || mongoose.model<IMessage>('Message', MessageSchema);

