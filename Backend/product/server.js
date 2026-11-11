import express from "express";
import morgan from "morgan";
import axios from "axios";
const PORT = process.env.PORT || 8080;


const app = express();

app.use(morgan("dev"));
app.use(express.json());

app.get('/api/product', async (req,res) => {
    const response = await axios.get("http://main-server-service");
    res.send(response.data)
})

app.listen(PORT, () => {
    console.log(`Server ns running on ${PORT}`);
})