// Importing Libraries (npm)
const express = require("express");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const session = require("express-session");
const { createReadStream, unlinkSync } = require("fs");
const multer = require("multer");
const csvtojson = require("csvtojson");

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("css"));

app.use(
  session({
    secret: "BreakingBad", // Use a strong secret key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set to true if using HTTPS
  })
);

// Database connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "pas",
});

// Terminal listen notification
app.listen(5002, () => {
  console.log("Server running on port 5002");
});

// Database connection notification
// Database connection notification
db.connect((err) => {
  if (err) {
    console.log("Error connecting to database");
  } else {
    console.log("MySql database connected");

    // Create students table
    db.query("DROP TABLE IF EXISTS students", (err) => {
      var createStudents =
        "CREATE TABLE students (ID int, Username varchar(255), " +
        "Password varchar(255), Team varchar(255));";

      db.query(createStudents, (err) => {
        if (err) console.log("ERROR: ", err);
      });
    });

    // Create teachers table
    db.query("DROP TABLE IF EXISTS teachers", (err) => {
      var createTeachers =
        "CREATE TABLE teachers (ID int, Username varchar(255), " +
        "Password varchar(255));";

      db.query(createTeachers, (err) => {
        if (err) console.log("ERROR: ", err);
      });
    });

    // Create evaluations table
    db.query("DROP TABLE IF EXISTS evaluations", (err) => {
      var createEvaluations =
        "CREATE TABLE evaluations (ID int AUTO_INCREMENT PRIMARY KEY, " +
        "teammateID int, cooperation int, comments text, reviewerID int);";

      db.query(createEvaluations, (err) => {
        if (err) console.log("ERROR: ", err);
      });
    });
  }
});

// Sets up file storage and naming
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now();
    cb(null, "students.csv");
  },
});
const upload = multer({ storage: storage, limits: { fileSize: 10000000 } });

// Routes

app.get("/", (req, res) => {
  const { username: Username, role: Role } = req.session.user || {};
  res.render("MainPage.ejs", { Username, Role });
});

app.get("/login", (req, res) => {
  res.render("Login.ejs");
});

app.get("/SignUp", (req, res) => {
  res.render("SignUp.ejs");
});

app.get("/Upload", (req, res) => {
  var uploaded = false;
  res.render("Upload.ejs", { uploaded });
});

app.get("/upload-complete", (req, res) => {
  var uploaded = true;
  res.render("Upload.ejs", { uploaded });
});

app.get("/assign-teams", (req, res) => {
  res.render("AssignTeams.ejs");
});

app.get("/get_students", (req, res) => {
  const sql = "SELECT ID, Username, Team FROM students ORDER BY Team ASC";

  db.query(sql, (err, results) => {
    if (err) {
      throw err;
    } else {
      res.send(results);
    }
  });
});

app.post("/update_team", (req, res) => {
  const id = req.body.id;
  let sql;
  if (req.body.team === "-") {
    sql = `UPDATE students SET Team= NULL WHERE ID = "${id}"`;
  } else {
    sql = `UPDATE students SET Team= "${req.body.team}" WHERE ID = "${id}"`;
  }

  db.query(sql, (err) => {
    if (err) {
      throw err;
    } else {
      res.json({ message: "Data Updated" });
    }
  });
});

app.post("/auto-assign-teams", (req, res) => {
  db.query("SELECT * FROM students", (err, result) => {
    var numOfStudents = result.length;
    var numOfTeams = Math.ceil(numOfStudents / req.body.size);
    for (let i = 0; i < numOfStudents; i++) {
      let team = (i % numOfTeams) + 1;
      db.query(`UPDATE students SET Team ='${team}' WHERE ID=${result[i].ID}`);
    }
    return res.send("Teams auto-assigned.");
  });
});

app.get("/Logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return console.log(err);
    }
    res.redirect("/");
  });
});

app.get("/TeamVis", (req, res) => {
  console.log("Session object:", req.session);

  const teamName = req.session.user.team;

  const teamQuery = "SELECT * FROM students WHERE Team = ?";

  db.query(teamQuery, [teamName], (err, result) => {
    if (result && result.length > 0) {
      let teamMembers = [];
      result.forEach((student) => {
        if (req.session.user.username != student.Username) {
          teamMembers.push(student);
        }
      });

      res.render("TeamVisibility.ejs", {
        teamMembers: teamMembers,
        teamName: teamName,
      });
    }
  });
});

app.get("/AllTeamVis", (req, res) => {
  console.log("Session object:", req.session);

  const TryQuery = "SELECT Team, Username, ID FROM students ORDER BY Team ASC";

  db.query(TryQuery, (err, result) => {
    let teams = {};
    result.forEach((student) => {
      const { Team, Username, ID } = student;
      if (!teams[Team]) {
        teams[Team] = [];
      }
      teams[Team].push(student); // Add the student to the corresponding team
    });

    res.render("AllTeams.ejs", { teams });
  });
});

// POSTS

app.post("/Register", (req, res) => {
  console.log("Recieved POST body request for registration", req.body);

  const { ID, Username, Password, Option } = req.body;
  const Values = [ID, Username, Password];

  if (Option === "Student") {
    // Check if student is in the system first
    const selectQuery = `SELECT * FROM students WHERE ID=${Values[0]}`;
    db.query(selectQuery, (error, result) => {
      if (error) {
        throw error;
      } else {
        console.log(result.length);
        if (result.length < 1) {
          console.log("Student not in database.");
          res.send({ resgistered: false });
        } else {
          // If they're in the system, registers student's password
          const updateQuery = `UPDATE students SET Password="${Password}" WHERE ID="${ID}"`;
          db.query(updateQuery, (error) => {
            if (error) {
              console.log("Error registering student");
              console.log(error);
            } else {
              console.log("Student sucessfully registered");
              res.send({ registered: true });
            }
          });
        }
      }
    });
  }

  // Adds teacher to the system
  if (Option === "Teacher") {
    const insertQuery =
      "INSERT INTO teachers (ID, Username, Password) VALUES (?,?,?)";
    db.query(insertQuery, Values, (error) => {
      if (error) {
        console.log("Error registering teacher");
        console.log(error);
      } else {
        console.log("Teacher sucessfully added");
        res.send({ registered: true });
      }
    });
  }
});

app.post("/LogUser", (req, res) => {
  console.log("Received POST request for login", req.body);

  const { Username, Password, Option } = req.body;

  let tryQuery;

  if (Option === "Student") {
    tryQuery = "SELECT * FROM students WHERE Username = ?";
  }

  if (Option === "Teacher") {
    tryQuery = "SELECT * FROM teachers WHERE Username = ?";
  }

  console.log("Executing query:", tryQuery, "with Username:", Username);

  db.query(tryQuery, Username, (err, result) => {
    if (result && result.length > 0) {
      if (result[0].Password == Password) {
        console.log("User Sucessfully Logged In");

        req.session.user = {
          id: result[0].ID,
          username: result[0].Username,
          role: Option,
          team: result[0].Team,
        };

        console.log("Session after login:", req.session.user);

        if (req.session.user.role === "Student") {
          res.redirect("/");
        } else {
          return res.redirect("/");
        }
      } else {
        console.log("Wrong Password");
      }
    } else {
      console.log("User Was not found");
    }
  });
});

// Adds students in the course through an uploaded csv file
app.post("/upload-students", upload.single("file"), (req, res) => {
  csvtojson()
    .fromFile("./students.csv")
    .then((source) => {
      unlinkSync("./students.csv");

      for (let i = 0; i < source.length; i++) {
        let values = [];
        values.push(source[i].ID, source[i].Name);
        let insertStatement =
          "INSERT INTO students (ID, Username) VALUES (?, ?)";

        db.query(insertStatement, values, (err) => {
          if (err) {
            console.log("Unable to insert student #", values[0]);
            return console.log(err);
          }
        });
      }
    });

  res.send("File processed successfully.");
});

function isAuthenticated(req, res, next) {
  if (req.session.user) {
    return next();
  } else {
    res.redirect("/login");
  }
}

// Route to render the evaluation page
// Route to render the evaluation page or view existing review
app.get("/evaluate/:id", (req, res) => {
  const teammateID = req.params.id;
  const reviewerID = req.session.user.id;

  const checkReviewQuery =
    "SELECT * FROM evaluations WHERE teammateID = ? AND reviewerID = ?";
  db.query(checkReviewQuery, [teammateID, reviewerID], (err, reviewResult) => {
    if (err) {
      throw err;
    } else if (reviewResult.length > 0) {
      // Review already exists, render the view review page
      res.render("ViewEvaluation.ejs", { review: reviewResult[0] });
    } else {
      // No review exists, render the evaluation page
      const query = "SELECT ID, Username FROM students WHERE ID = ?";
      db.query(query, [teammateID], (err, result) => {
        if (err) {
          throw err;
        } else {
          res.render("Evaluation.ejs", { teammate: result[0] });
        }
      });
    }
  });
});

app.post("/submit-evaluation", (req, res) => {
  const { teammateID, cooperation, comments } = req.body;
  const reviewerID = req.session.user.id;
  const insertQuery =
    "INSERT INTO evaluations (teammateID, cooperation, comments, reviewerID) VALUES (?, ?, ?, ?)";
  db.query(
    insertQuery,
    [teammateID, cooperation, comments, reviewerID],
    (err) => {
      if (err) {
        throw err;
      } else {
        res.redirect("/TeamVis");
      }
    }
  );
});
