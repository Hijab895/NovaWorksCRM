export function parseSkills(skillsJson) {
  try {
    const skills = JSON.parse(skillsJson)
    return Array.isArray(skills) ? skills : []
  } catch {
    return []
  }
}

export function toSafeUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    specialization: row.specialization,
    skills: parseSkills(row.skills_json),
  }
}
