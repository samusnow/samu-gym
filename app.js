let workout;
let round = 1;
let index = 0;
let mode = "exercise"; // exercise | rest | roundRest | finished
let paused = false;
let timer = null;
let remaining = 0;
let total = 0;
let startTime = Date.now();

const bellSounds = [
  new Audio("sounds/bell.mp3"),
  new Audio("sounds/bell.mp3"),
  new Audio("sounds/bell.mp3")
];

bellSounds.forEach(audio => {
  audio.preload = "auto";
  audio.volume = 0.8;
});

let bellIndex = 0;
let audioUnlocked = false;

function unlockAudio(){
  if(audioUnlocked) return;

  Promise.allSettled(
    bellSounds.map(audio => {
      audio.volume = 0;
      return audio.play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 0.8;
        });
    })
  ).then(() => {
    bellSounds.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 0.8;
    });

    audioUnlocked = true;
    console.log("Audio sbloccato");
  });
}
const els = {
  title: document.getElementById("title"),
  subtitle: document.getElementById("subtitle"),
  status: document.getElementById("status"),
  round: document.getElementById("round"),
  step: document.getElementById("step"),
  group: document.getElementById("group"),
  exercise: document.getElementById("exercise"),
  img: document.getElementById("exerciseImg"),
  fallback: document.getElementById("imageFallback"),
  target: document.getElementById("target"),
  tips: document.getElementById("tips"),
  timer: document.getElementById("timer"),
  bar: document.getElementById("bar"),
  done: document.getElementById("done"),
  pause: document.getElementById("pause"),
  prev: document.getElementById("prev"),
  card: document.querySelector(".card")
};

fetch("workout.json")
  .then(r => r.json())
  .then(data => {
    workout = data;
    els.title.textContent = data.title || "Samu-Gym";
    els.subtitle.textContent = data.subtitle || "";
    renderExercise();
  })
  .catch(err => {
    document.body.innerHTML = "<h1>Errore caricamento workout.json</h1><pre>"+err+"</pre>";
  });

function currentExercise(){ 
  return workout.exercises[index]; 
}

function renderExercise(){
  clearTimer();
  mode = "exercise";
  paused = false;

  els.card.className = "card";

  const ex = currentExercise();

  els.status.textContent = "Esercizio";
  els.round.textContent = `Giro ${round}/${workout.rounds}`;
  els.step.textContent = `Esercizio ${index+1}/${workout.exercises.length}`;
  els.group.textContent = ex.group || "";
  els.exercise.textContent = ex.name;
  els.target.textContent = ex.duration ? `${ex.duration} sec` : (ex.reps || "");
  els.timer.classList.add("hidden");
  els.bar.style.width = "0%";

  els.tips.innerHTML = "";
  (ex.tips || []).forEach(t => {
    const li = document.createElement("li");
    li.textContent = t;
    els.tips.appendChild(li);
  });

  els.img.src = ex.image || "";
  els.img.style.display = ex.image ? "block" : "none";
  els.fallback.style.display = "none";

  els.img.onerror = () => {
    els.img.style.display = "none";
    els.fallback.style.display = "block";
  };

  if(ex.duration){
    els.done.textContent = "AVVIA TIMER ▶";
  } else {
    els.done.textContent = "FATTO / AVANTI ▶";
  }

  els.pause.textContent = "⏸ Pausa";
}

function completeExercise(){
  const ex = currentExercise();

  if(ex.duration && mode === "exercise"){
    startCountdown(ex.duration, "exerciseTimer");
    return;
  }

  startRest(ex.rest ?? workout.defaultRest ?? 60);
}

function startRest(seconds){
  if(seconds <= 0){ 
    nextExercise(); 
    return; 
  }

  mode = "rest";

  els.card.classList.add("restMode");
  els.status.textContent = "Recupero";
  els.round.textContent = `Giro ${round}/${workout.rounds}`;
  els.step.textContent = `Esercizio ${index+1}/${workout.exercises.length}`;
  els.group.textContent = "⏳ RECUPERO";
  els.exercise.textContent = "Respira. Prossimo esercizio in arrivo.";

  els.img.src = "img/hourglass.png";
  els.img.style.display = "block";
  els.fallback.style.display = "none";

  els.target.textContent = "";
  els.tips.innerHTML = "";

  startCountdown(seconds, "rest");
}

function startRoundRest(){
  mode = "roundRest";

  els.card.classList.add("restMode");
  els.status.textContent = "Pausa giro";
  els.round.textContent = `Giro ${round}/${workout.rounds}`;
  els.step.textContent = "Fine giro";
  els.group.textContent = "⏳ RECUPERO TRA I GIRI";
  els.exercise.textContent = `Preparati al giro ${round+1}/${workout.rounds}`;

  els.img.src = "img/hourglass.png";
  els.img.style.display = "block";
  els.fallback.style.display = "none";

  els.target.textContent = "";
  els.tips.innerHTML = "";

  startCountdown(workout.betweenRoundsRest || 120, "roundRest");
}

function startCountdown(seconds, countdownType){
  clearTimer();

  total = seconds;
  remaining = seconds;
  paused = false;

  els.timer.classList.remove("hidden");
  els.done.textContent = "SALTA ▶";

  tick();

  timer = setInterval(() => {
    if(!paused){
      remaining--;
      tick();

      if(remaining <= 0){
        beep();
        clearTimer();

        if(countdownType === "exerciseTimer"){
          startRest(currentExercise().rest ?? workout.defaultRest ?? 60);
        } else if(countdownType === "roundRest"){
          round++;
          index = 0;
          renderExercise();
        } else {
          nextExercise();
        }
      }
    }
  }, 1000);
}

function tick(){
  const m = String(Math.floor(remaining/60)).padStart(2,"0");
  const s = String(remaining%60).padStart(2,"0");

  els.timer.textContent = `${m}:${s}`;

  if(total > 0){
    els.bar.style.width = `${100 - (remaining/total*100)}%`;
  } else {
    els.bar.style.width = "0%";
  }
}

function nextExercise(){
  clearTimer();

  if(index < workout.exercises.length - 1){
    index++;
    renderExercise();
  } else if(round < workout.rounds){
    startRoundRest();
  } else {
    finish();
  }
}

function previous(){
  clearTimer();

  if(mode !== "exercise"){
    renderExercise();
    return;
  }

  if(index > 0){
    index--;
    renderExercise();
  } else if(round > 1){
    round--;
    index = workout.exercises.length - 1;
    renderExercise();
  }
}

function finish(){
  mode = "finished";
  els.card.className = "card finished";

  const mins = Math.round((Date.now()-startTime)/60000);

  els.status.textContent = "Finito";
  els.round.textContent = "Allenamento completato";
  els.step.textContent = "";
  els.group.textContent = "🎉 SAMU-GYM";
  els.exercise.textContent = "Grande Samu!";

  els.img.src = "img/finish.png";
  els.img.style.display = "block";
  els.fallback.style.display = "none";

  els.target.textContent = `Tempo: ${mins} min`;
  els.tips.innerHTML = "<li>3 giri completati</li><li>Adesso recupero e proteine 😄</li>";

  els.timer.classList.add("hidden");
  els.bar.style.width = "100%";
  els.done.textContent = "RICOMINCIA";
}

function clearTimer(){ 
  if(timer){ 
    clearInterval(timer); 
    timer = null; 
  } 
}

function togglePause(){
  unlockAudio();

  if(mode === "finished") return;

  paused = !paused;

  els.pause.textContent = paused ? "▶ Riprendi" : "⏸ Pausa";

  if(paused){
    els.status.textContent = "Pausa";
  } else {
    els.status.textContent = (mode === "exercise") ? "Esercizio" : "Recupero";
  }
}

function beep(){
  bellSound.currentTime = 0;
  bellSound.volume = 0.8;

  bellSound.play().catch(e => {
    console.log("Campana bloccata o non riproducibile", e);
  });
}

els.done.onclick = () => {
  unlockAudio();

  if(mode === "finished"){
    round = 1;
    index = 0;
    startTime = Date.now();
    renderExercise();
    return;
  }

  if(mode === "exercise"){
    completeExercise();
  } else {
    nextExercise();
  }
};

els.pause.onclick = togglePause;

els.prev.onclick = () => {
  unlockAudio();
  previous();
};

document.addEventListener("keydown", e => {
  if(["Enter"," ","ArrowRight"].includes(e.key)){
    e.preventDefault();
    els.done.click();
  }

  if(e.key.toLowerCase() === "p"){
    togglePause();
  }

  if(e.key === "ArrowLeft"){
    previous();
  }
});