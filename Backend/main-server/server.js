import express from "express";
import morgan from "morgan";
const app = express();
const PORT = process.env.PORT || 3000;

app.use(morgan("dev"));
app.use(express.json());

app.get("/", (req, res) => {
  let sum = 0;
  for (let i = 1; i < 1e9; i++) sum += i;

  res
  .status(200)
  .json({
    message:"Sum Calculated",
    sum
  });
  
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
