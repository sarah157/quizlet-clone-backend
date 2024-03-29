const { Schema, model } = require("mongoose");
const folderSchema = new Schema(
  {
    title: {
      type: String,
      minlength: 1,
      maxlength: 60,
      required: [true, "Folder title cannot be blank"],
    },
    description: {type: String, default: ""},
    decks: [
      {
        type: Schema.Types.ObjectId,
        ref: "Deck",
      },
    ],
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = model("Folder", folderSchema);
