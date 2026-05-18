import React, { useState, useEffect } from "react";
import "./App.css";

const API = import.meta.env.VITE_API_URL;

export default function App() {
  const [candidates, setCandidates] = useState([]);
  const [recommendation, setRecommendation] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [jobSkills, setJobSkills] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    skills: "",
    experience: "",
    bio: ""
  });

  const [errors, setErrors] = useState({});

  /* ================= FETCH ================= */

  const fetchCandidates = async () => {
    try {
      const res = await fetch(`${API}/api/candidates`);
      const data = await res.json();
      setCandidates(data?.candidates || []);
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  /* ================= INPUT ================= */

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  /* ================= VALIDATION ================= */

  const validateForm = () => {
    const newErrors = {};

    if (!form.name.trim()) newErrors.name = "Name required";
    if (!form.email.trim()) newErrors.email = "Email required";
    if (!form.skills.trim()) newErrors.skills = "Skills required";
    if (!form.experience.trim()) newErrors.experience = "Experience required";

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  /* ================= RESET ================= */

  const resetForm = () => {
    setForm({
      name: "",
      email: "",
      skills: "",
      experience: "",
      bio: ""
    });

    setEditingId(null);
    setErrors({});
  };

  /* ================= ADD ================= */

  const addCandidate = async () => {
    if (!validateForm()) return;

    try {
      await fetch(`${API}/api/candidates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          skills: form.skills.split(",").map(s => s.trim()).filter(Boolean),
          experience: parseInt(form.experience),
          bio: form.bio
        })
      });

      await fetchCandidates();
      resetForm();

    } catch (err) {
      console.log(err);
    }
  };

  /* ================= DELETE ================= */

  const deleteCandidate = async (id) => {
    try {
      await fetch(`${API}/api/candidates/${id}`, {
        method: "DELETE"
      });

      await fetchCandidates();

    } catch (err) {
      console.log(err);
    }
  };

  /* ================= EDIT ================= */

  const editCandidate = (c) => {
    setForm({
      name: c.name,
      email: c.email,
      skills: c.skills.join(", "),
      experience: c.experience.toString(),
      bio: c.bio
    });

    setEditingId(c._id);
  };

  /* ================= UPDATE ================= */

  const updateCandidate = async () => {
    if (!validateForm()) return;

    try {
      await fetch(`${API}/api/candidates/${editingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          skills: form.skills.split(",").map(s => s.trim()).filter(Boolean),
          experience: parseInt(form.experience),
          bio: form.bio
        })
      });

      await fetchCandidates();
      resetForm();

    } catch (err) {
      console.log(err);
    }
  };

  /* ================= AI ================= */

  const generateAI = async () => {
    if (!jobSkills.trim()) {
      setRecommendation("Please enter required skills first.");
      return;
    }

    setLoadingAI(true);
    setRecommendation("");

    try {
      const res = await fetch(`${API}/api/ai/shortlist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          requiredSkills: jobSkills
            .split(",")
            .map(skill => skill.trim())
            .filter(Boolean)
        })
      });

      const data = await res.json();

      setRecommendation(
        data?.recommendation || data?.error || "No response"
      );

    } catch (err) {
      setRecommendation("AI request failed.");
    } finally {
      setLoadingAI(false);
    }
  };

  return (
    <div className="dashboard">

      <aside className="sidebar">
        <h2>HireSphere AI</h2>
        <p>Recruitment Intelligence System</p>
      </aside>

      <main className="main">

        <section className="form-section">
          <h1>{editingId ? "Update Candidate" : "Add Candidate"}</h1>

          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Name"
          />

          <input
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="Email"
          />

          <input
            name="skills"
            value={form.skills}
            onChange={handleChange}
            placeholder="React, Node"
          />

          <input
            name="experience"
            type="number"
            value={form.experience}
            onChange={handleChange}
            placeholder="Experience"
          />

          <textarea
            name="bio"
            value={form.bio}
            onChange={handleChange}
            placeholder="Bio"
          />

          <button onClick={editingId ? updateCandidate : addCandidate}>
            {editingId ? "Update Candidate" : "Save Candidate"}
          </button>

          {editingId && (
            <button onClick={resetForm}>
              Cancel
            </button>
          )}
        </section>

        <section className="candidate-section">
          <h1>Candidates</h1>

          {candidates.map(c => (
            <div className="card" key={c._id}>
              <h3>{c.name}</h3>
              <p>{c.email}</p>
              <p>{c.skills.join(", ")}</p>
              <p>{c.experience} yrs</p>

              <button onClick={() => editCandidate(c)}>Edit</button>
              <button onClick={() => deleteCandidate(c._id)}>Delete</button>
            </div>
          ))}
        </section>

        <section className="ai-section">
          <h1>AI Candidate Shortlisting</h1>

          <input
            placeholder="Enter required skills (React, Node.js, MongoDB)"
            value={jobSkills}
            onChange={(e) => setJobSkills(e.target.value)}
          />

          <button onClick={generateAI} disabled={loadingAI}>
            {loadingAI ? "Analyzing..." : "Generate AI Report"}
          </button>

          <div className="ai-output">
            <h2>Candidate Intelligence Report</h2>

            <div className="ai-box">
              {recommendation.split("\n").map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        </section>

      </main>

      <aside className="right-panel">
        <h2>Stats</h2>
        <p>Total Candidates: {candidates.length}</p>
      </aside>

    </div>
  );
}