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

/* ================= ADD CANDIDATE ================= */

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
  res.json({
    success: true,
    candidates
  });
});

/* ================= SEARCH ================= */

app.get("/api/candidates/search", async (req, res) => {
  try {
    const skill = req.query.skill;

    const candidates = await Candidate.find({
      skills: { $regex: skill, $options: "i" }
    });

    res.json({
      success: true,
      candidates
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
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

/* ================= MATCH ================= */

function matchCandidates(candidates, job) {
  return candidates.map(candidate => {

    const matchedSkills = candidate.skills.filter(skill =>
      job.requiredSkills.includes(skill)
    );

    const score =
      (matchedSkills.length / job.requiredSkills.length) * 100 +
      (candidate.experience * 5);

    return {
      ...candidate._doc,
      matchScore: score
    };

  }).sort((a, b) => b.matchScore - a.matchScore);
}

app.post("/api/match", async (req, res) => {
  const candidates = await Candidate.find();
  const results = matchCandidates(candidates, req.body);

  res.json({
    success: true,
    shortlistedCandidates: results
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

No candidate profiles match:

${requiredSkills.join(", ")}

Recommendation:
Add more candidate profiles or modify search criteria.
`
      });
    }

    const prompt = `
You are a senior technical recruitment analyst.

Evaluate ONLY these matched candidates for:

${requiredSkills.join(", ")}

Return a professional report with:

==================================================
CANDIDATE SHORTLISTING REPORT
==================================================

TOP RANKED CANDIDATES
(Name, Match Score, Recommendation, Reason)

SKILL GAP ANALYSIS

INTERVIEW QUESTION SUGGESTIONS

FINAL HIRING RECOMMENDATION

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
          "Content-Type": "application/json"
        }
      }
    );

    res.json({
      success: true,
      recommendation: response.data.choices[0].message.content
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* ================= SHORTLIST ================= */

app.put("/api/candidates/:id/shortlist", async (req, res) => {
  const updated = await Candidate.findByIdAndUpdate(
    req.params.id,
    { shortlisted: true },
    { new: true }
  );

  res.json({
    success: true,
    candidate: updated
  });
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});