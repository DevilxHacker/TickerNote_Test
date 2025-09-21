import * as tickerService from "../services/screenerService.js";

export const getTickers = async (req, res, next) => {
  try {
    const { prompt } = req.body; // frontend sends these
    const tickers = await tickerService.fetchTickers( prompt);
    res.json({ tickers });
  } catch (error) {
    next(error);
  }
};