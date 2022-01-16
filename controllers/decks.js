const { StatusCodes } = require("http-status-codes");
const mongoose = require('mongoose')
const catchAsync = require("../utils/catchAsync");
const { NotFoundError, BadRequestError } = require("../utils/errors");
const {
  ACTION_TYPE,
  ACCESS_TYPE,
  ALLOWED_DECK_FIELDS,
} = require("../constants");

const Deck = require("../models/Deck");
const Card = require("../models/Card");
const User = require("../models/User");
const { isEmpty } = require("../utils/helpers");

// Get decks by username or userId. If both are given, userId is used
module.exports.getDecksByUser = catchAsync(async (req, res) => {
  if (!req.query.userId && !req.query.username) {
    throw new BadRequestError("Please provide a userId or username");
  }
  const user = req.query?.userId
    ? await User.findById(req.query.userId)
    : await User.findOne({ username: req.query.username });

  if (!user) throw new NotFoundError("User not found");

  const match =
    user._id.toString() === req.user?.userId
      ? { owner: user._id }
      : { owner: user._id, visibleTo: ACCESS_TYPE.PUBLIC };

  const decks = await Deck.aggregate([
    { $match: match},
    {
      $project: {
        title: 1,
        description: 2,
        cardsCount: { $size: "$cards" }
      }
    },
  ]);

  res.status(StatusCodes.OK).json({ decks });
});

module.exports.createDeck = catchAsync(async (req, res) => {
  const deck = await new Deck({
    ...req.body,
    owner: req.user.userId,
  }).save();

  res.status(StatusCodes.CREATED).json({ deck });
});

module.exports.showDeck = catchAsync(async (req, res) => {
  const deck = await Deck.findById(req.params.deckId).populate({path: "cards"})
  res.status(StatusCodes.OK).json({ deck });
});

module.exports.updateDeck = catchAsync(async (req, res) => {
  const deck = await Deck.findById(req.params.deckId);
  if (req.body.hasOwnProperty("password")) {
    await deck.hashPassword(req.body.password);
  }
  if (
    !deck.password &&
    (req.body.editableBy === ACCESS_TYPE.PASSWORD_PROTECTED ||
      req.body.visibleTo === ACCESS_TYPE.PASSWORD_PROTECTED)
  ) {
    throw new BadRequestError(
      "Deck has no password. Please create a password."
    );
  }
  const { password, ...otherData } = req.body;

  const updatedDeck = await Deck.findByIdAndUpdate(
    req.params.deckId,
    { $set: otherData },
    { new: true, runValidators: true }
  );

  res.status(StatusCodes.OK).json({ deck: updatedDeck });
});

module.exports.deleteDeck = catchAsync(async (req, res, next) => {
  await Deck.findByIdAndDelete(req.params.deckId);
  res.status(StatusCodes.OK).json();
});

module.exports.reorderCards = catchAsync(async (req, res, next) => {
  const { index, cardId } = req.body;
  if (!index || !cardId)
    throw new BadRequestError("cardId and index are required");

  const deck = await Deck.findById(req.params.deckId);
  if (!deck) throw new NotFoundError("Deck not found");

  const card = await Card.findById(cardId);
  if (!card) throw new NotFoundError("Card not found");

  const maxIndex = deck.cards.length - 1;

  // Remove card from deck then insert into correct position
  deck.cards = deck.cards.filter((c) => c._id.toString() !== cardId);
  if (!deck.cards.length || index >= maxIndex) deck.cards.push(card._id);
  else deck.cards.splice(index, 0, card._id);
  deck.save();

  res.status(StatusCodes.CREATED).json({ card });
});
