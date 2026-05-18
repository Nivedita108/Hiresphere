const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const axios = require("axios");

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

const candidateSchema = new mongoose.Schema({
  name: String,
  email: String,
  skills: [String],
  experience: Number,
  bio: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Candidate = mongoose.model("Candidate", candidateSchema);

/* ADD */

app.post("/api/candidates", async (req, res) => {
  try {
    const candidate = new Candidate(req.body);
    await candidate.save();
    res.json(candidate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* GET */

app.get("/api/candidates", async (req, res) => {
  const candidates = await Candidate.find();
  res.json({ candidates });
});

/* UPDATE */

app.put("/api/candidates/:id", async (req, res) => {
  const updated = await Candidate.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );

  res.json(updated);
});

/* DELETE */

app.delete("/api/candidates/:id", async (req, res) => {
  await Candidate.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* AI */

app.post("/api/ai/shortlist", async (req, res) => {
  try {
    const { requiredSkills } = req.body;

    const candidates = await Candidate.find();

    const matched = candidates.filter(c =>
      c.skills.some(skill =>
        requiredSkills.some(r =>
          skill.toLowerCase() === r.toLowerCase()
        )
      )
    );

    if (!matched.length) {
      return res.json({
        recommendation: "No matching candidates found."
      });
    }

    const prompt = `
Analyze these candidates:

${JSON.stringify(matched)}

Required skills:
${requiredSkills.join(", ")}

Return hiring recommendation report.
`;

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://hiresphere1.onrender.com",
          "X-Title": "HireSphere AI"
        }
      }
    );

    res.json({
      recommendation: response.data.choices[0].message.content
    });

  } catch (error) {
    console.log(error.response?.data || error.message);

    res.status(500).json({
      error: error.response?.data || error.message
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});