from flask import Flask, render_template, request, session, redirect
from extra import login_required, apology
from flask_session import Session
from tempfile import mkdtemp
from werkzeug.security import check_password_hash, generate_password_hash
from cs50 import SQL

db = SQL("sqlite:///data.db")
app = Flask(__name__)
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.config["SESSION_FILE_DIR"] = mkdtemp()
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"
Session(app)

@app.after_request
def after_request(response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Expires"] = 0
    response.headers["Pragma"] = "no-cache"
    return response

@app.route("/")
@login_required
def index():
    return render_template("index.html")

@app.route("/login", methods=["POST", "GET"])
def login():

    session.clear()

    if request.method == "POST":
        if not request.form.get("username"):
            return apology("must provide username", 403)

        # Ensure password was submitted
        elif not request.form.get("password"):
            return apology("must provide password", 403)

        # Query database for username
        rows = db.execute("SELECT * FROM users WHERE username = ?", request.form.get("username"))
        
        # Ensure username exists and password is correct
        if len(rows) != 1:
            return apology("invalid username and-or password", 403)
        elif not check_password_hash(rows[0]["hash"], request.form.get("password")):
            return apology("hash error", 400)

        # Remember which user has logged in
        session["user_id"] = rows[0]["id"]

        # Redirect user to home page
        return redirect("/")
    else:
        return render_template("login.html") 

@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")

@app.route("/register", methods=["POST", "GET"])
def register():
    if request.method == "POST":
        if not request.form.get("username"):
            return apology("You are required to enter your name.")
        elif not request.form.get("password"):
            return apology("You are required to enter your password")
        elif not request.form.get('email'):
            return apology("You are required to enter your email")

        rows = db.execute("SELECT * FROM users WHERE username = ?", (request.form.get("username"),))
        if len(rows) >= 1:
            return apology("Sorry, username taken.")

        if request.form.get("password") != request.form.get("confirmation"):
            return apology("Sorry, password doesn't match")

        username = request.form.get("username")
        hashh = generate_password_hash(request.form.get("password"))
        email = request.form.get("email")

        db.execute("INSERT INTO users (username, hash, email) VALUES(?, ?, ?)", username, hashh, email)
        return redirect("/")
    else:
        return render_template("register.html")
    
@app.route("/games", methods=["POST", "GET"])
@login_required
def games():
    if request.method == "POST":
        game = request.form.get("game")
        if game == "Breakout":
            return render_template("breakout.html")
        elif game == "Platformer":
            return render_template("platformer.html")
        elif game == "Hello World":
            return render_template("hello.html")
        elif game == "Puzzle":
            return render_template("puzzle.html")
        elif game == "Stress":
            return render_template("stress.html")
    else:
        return render_template("games.html")


