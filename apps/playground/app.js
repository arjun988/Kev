const form = document.getElementById("form");
const out = document.getElementById("out");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  out.textContent = "Evaluating…";

  let criteria;
  try {
    criteria = JSON.parse(document.getElementById("choiceCriteria").value);
  } catch {
    out.textContent = "Choice criteria must be valid JSON.";
    return;
  }

  const payload = {
    model: "kev-latest",
    state: document.getElementById("state").value,
    questions: {
      topic: {
        type: "choice",
        instructions: document.getElementById("choiceInstr").value,
        criteria,
      },
      escalate: {
        type: "noul",
        instructions: document.getElementById("noulInstr").value,
      },
    },
    trace: document.getElementById("trace").checked,
  };

  try {
    const res = await fetch("/v1/systemone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    out.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    out.textContent = String(err);
  }
});
