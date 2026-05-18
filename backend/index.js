const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const axios = require("axios");

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());

/* ================= DATABASE ================= */

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

/* ================= SCHEMA ================= */

const candidateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  skills: { type: [String], required: true },
  experience: { type: Number, required: true },
  bio: { type: String, default: "" },
  matchScore: { type: Number, default: 0 },
  shortlisted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Candidate = mongoose.model("Candidate", candidateSchema);

/* ================= ADD ================= */

app.post("/api/candidates", async (req, res) => {
  try {
    const { name, email, skills, experience, bio } = req.body;

    if (!name || !email || !skills || experience === undefined) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields"
      });
    }

    const candidate = new Candidate({
      name,
      email,
      skills,
      experience: Number(experience),
      bio
    });

    await candidate.save();

    res.status(201).json({
      success: true,
      candidate
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* ================= GET ALL ================= */

app.get("/api/candidates", async (req, res) => {
  const candidates = await Candidate.find();
  res.json({ success: true, candidates });
});

/* ================= UPDATE ================= */

app.put("/api/candidates/:id", async (req, res) => {
  try {
    const updated = await Candidate.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        experience: Number(req.body.experience)
      },
      { new: true }
    );

    res.json({
      success: true,
      candidate: updated
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* ================= DELETE ================= */

app.delete("/api/candidates/:id", async (req, res) => {
  await Candidate.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: "Candidate Deleted"
  });
});

/* ================= AI SHORTLIST ================= */

app.post("/api/ai/shortlist", async (req, res) => {
  try {
    const candidates = await Candidate.find();
    const { requiredSkills } = req.body;

    if (!requiredSkills || requiredSkills.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Required skills are missing"
      });
    }

    const matchedCandidates = candidates.filter(candidate =>
      candidate.skills.some(skill =>
        requiredSkills.some(reqSkill =>
          skill.toLowerCase() === reqSkill.toLowerCase()
        )
      )
    );

    if (matchedCandidates.length === 0) {
      return res.json({
        success: true,
        recommendation: `
==================================================
CANDIDATE SHORTLISTING REPORT
==================================================

NO MATCHING CANDIDATES FOUND

Required Skills:
${requiredSkills.join(", ")}

Recommendation:
Add more candidate profiles or modify search criteria.
`
      });
    }

    const prompt = `
You are a senior technical recruitment analyst.

Analyze these candidates for:
${requiredSkills.join(", ")}

Provide:
1. Top Ranked Candidates
2. Match Scores
3. Skill Gap Analysis
4. Interview Questions
5. Final Hiring Recommendation

Candidates:
${JSON.stringify(matchedCandidates)}
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
          "HTTP-Referer": "https://hiresphere-7pcq.onrender.com",
          "X-Title": "HireSphere AI"
        }
      }
    );

    res.json({
      success: true,
      recommendation: response.data.choices[0].message.content
    });

  } catch (error) {
    console.log("AI ERROR:", error.response?.data || error.message);

    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});