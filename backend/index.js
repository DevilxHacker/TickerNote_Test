import app from "./src/app.js";
import { PORT } from "./src/config/serverConfig.js";

app.listen(PORT, () =>
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
);
