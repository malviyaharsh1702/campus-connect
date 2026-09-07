const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const User = require("./User");
const LostFound = require("./LostFound");
const Problem = require("./Problem");

const app = express();

app.use(cors());
app.use(express.json());


// =====================================================
// HOME
// =====================================================

app.get("/", (req, res) => {
    res.send("CampusConnect Backend is Running!");
});


// =====================================================
// REGISTER
// =====================================================

app.post("/api/register", async (req, res) => {
    try {
        const {
            fullName,
            email,
            collegeId,
            accountType,
            password
        } = req.body;

        if (
            !fullName ||
            !email ||
            !collegeId ||
            !accountType ||
            !password
        ) {
            return res.status(400).json({
                message: "All fields are required."
            });
        }

        const existingUser = await User.findOne({
            $or: [
                { email: email.toLowerCase() },
                { collegeId: collegeId }
            ]
        });

        if (existingUser) {
            return res.status(409).json({
                message: "Email or College ID already exists."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            fullName: fullName.trim(),
            email: email.toLowerCase().trim(),
            collegeId: collegeId.trim(),
            accountType,
            password: hashedPassword
        });

        await user.save();

        res.status(201).json({
            message: "Registration successful."
        });

    } catch (error) {
        console.error("Register Error:", error);

        res.status(500).json({
            message: "Server error during registration."
        });
    }
});


// =====================================================
// LOGIN
// =====================================================

app.post("/api/login", async (req, res) => {
    try {
        const {
            email,
            password
        } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required."
            });
        }

        const user = await User.findOne({
            email: email.toLowerCase().trim()
        });

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        const token = jwt.sign(
            {
                userId: user._id,
                accountType: user.accountType
            },
            process.env.JWT_SECRET || "campusconnect_secret",
            {
                expiresIn: "7d"
            }
        );

        res.status(200).json({
            message: "Login successful.",
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                collegeId: user.collegeId,
                accountType: user.accountType
            }
        });

    } catch (error) {
        console.error("Login Error:", error);

        res.status(500).json({
            message: "Server error during login."
        });
    }
});

// =====================================================
// FORGOT PASSWORD - CREATE RESET TOKEN
// =====================================================

app.post("/api/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                message: "Email is required."
            });
        }

        const user = await User.findOne({
            email: email.toLowerCase().trim()
        });

        if (!user) {
            return res.status(404).json({
                message: "No account found with this email."
            });
        }

        const resetToken = jwt.sign(
            {
                userId: user._id,
                purpose: "password-reset"
            },
            process.env.JWT_SECRET || "campusconnect_secret",
            {
                expiresIn: "10m"
            }
        );

        res.status(200).json({
            message: "Reset request created.",
            resetToken
        });

    } catch (error) {
        console.error("Forgot Password Error:", error);

        res.status(500).json({
            message: "Server error while creating reset request."
        });
    }
});


// =====================================================
// RESET PASSWORD
// =====================================================

app.post("/api/reset-password", async (req, res) => {
    try {
        const {
            resetToken,
            newPassword
        } = req.body;

        if (!resetToken || !newPassword) {
            return res.status(400).json({
                message: "Reset token and new password are required."
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters."
            });
        }

        const decoded = jwt.verify(
            resetToken,
            process.env.JWT_SECRET || "campusconnect_secret"
        );

        if (decoded.purpose !== "password-reset") {
            return res.status(401).json({
                message: "Invalid reset token."
            });
        }

        const user = await User.findById(
            decoded.userId
        );

        if (!user) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        const hashedPassword = await bcrypt.hash(
            newPassword,
            10
        );

        user.password = hashedPassword;

        await user.save();

        res.status(200).json({
            message: "Password reset successfully."
        });

    } catch (error) {
        console.error("Reset Password Error:", error);

        if (
            error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError"
        ) {
            return res.status(401).json({
                message: "Invalid or expired reset token."
            });
        }

        res.status(500).json({
            message: "Server error while resetting password."
        });
    }
});


// =====================================================
// CAMPUS PROBLEMS - CREATE
// =====================================================

app.post("/api/problems", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {
            return res.status(401).json({
                message: "Authentication required."
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || "campusconnect_secret"
        );

        const {
            category,
            priority,
            location,
            title,
            description
        } = req.body;

        if (
            !category ||
            !priority ||
            !location ||
            !title ||
            !description
        ) {
            return res.status(400).json({
                message: "All fields are required."
            });
        }

        const problem = new Problem({
            category,
            priority,
            location,
            title,
            description,
            reportedBy: decoded.userId
        });

        await problem.save();

        res.status(201).json({
            message: "Problem reported successfully.",
            problem
        });

    } catch (error) {
        console.error("Create Problem Error:", error);

        if (
            error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError"
        ) {
            return res.status(401).json({
                message: "Invalid or expired token."
            });
        }

        res.status(500).json({
            message: "Server error while reporting problem."
        });
    }
});


// =====================================================
// MY CAMPUS PROBLEMS
// =====================================================

app.get("/api/problems/my", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {
            return res.status(401).json({
                message: "Authentication required."
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || "campusconnect_secret"
        );

        const problems = await Problem.find({
            reportedBy: decoded.userId
        })
            .populate(
                "reportedBy",
                "fullName email collegeId accountType"
            )
            .sort({ createdAt: -1 });

        res.status(200).json({
            problems
        });

    } catch (error) {
        console.error("Get My Problems Error:", error);

        if (
            error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError"
        ) {
            return res.status(401).json({
                message: "Invalid or expired token."
            });
        }

        res.status(500).json({
            message: "Server error while fetching problems."
        });
    }
});


// =====================================================
// ALL CAMPUS PROBLEMS - STAFF ONLY
// =====================================================

app.get("/api/problems", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {
            return res.status(401).json({
                message: "Authentication required."
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || "campusconnect_secret"
        );

        if (
            decoded.accountType !== "Staff" &&
            decoded.accountType !== "staff"
        ) {
            return res.status(403).json({
                message: "Staff access required."
            });
        }

        const problems = await Problem.find()
            .populate(
                "reportedBy",
                "fullName email collegeId accountType"
            )
            .sort({ createdAt: -1 });

        res.status(200).json({
            problems
        });

    } catch (error) {
        console.error("Get All Problems Error:", error);

        if (
            error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError"
        ) {
            return res.status(401).json({
                message: "Invalid or expired token."
            });
        }

        res.status(500).json({
            message: "Server error while fetching problems."
        });
    }
});


// =====================================================
// UPDATE CAMPUS PROBLEM STATUS - STAFF ONLY
// =====================================================

app.patch("/api/problems/:id/status", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {
            return res.status(401).json({
                message: "Authentication required."
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || "campusconnect_secret"
        );

        if (
            decoded.accountType !== "Staff" &&
            decoded.accountType !== "staff"
        ) {
            return res.status(403).json({
                message: "Staff access required."
            });
        }

        const {
            status
        } = req.body;

        const allowedStatuses = [
            "Pending",
            "In Progress",
            "Resolved"
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                message:
                    "Invalid status. Allowed values: Pending, In Progress, Resolved."
            });
        }

        const updatedProblem =
            await Problem.findByIdAndUpdate(
                req.params.id,
                {
                    status
                },
                {
                    new: true,
                    runValidators: true
                }
            ).populate(
                "reportedBy",
                "fullName email collegeId accountType"
            );

        if (!updatedProblem) {
            return res.status(404).json({
                message: "Problem not found."
            });
        }

        res.status(200).json({
            message: "Problem status updated successfully.",
            problem: updatedProblem
        });

    } catch (error) {
        console.error(
            "Update Problem Status Error:",
            error
        );

        if (error.name === "CastError") {
            return res.status(400).json({
                message: "Invalid problem ID."
            });
        }

        if (
            error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError"
        ) {
            return res.status(401).json({
                message: "Invalid or expired token."
            });
        }

        res.status(500).json({
            message:
                "Server error while updating problem status."
        });
    }
});


// =====================================================
// LOST & FOUND - CREATE
// =====================================================

app.post("/api/lost-found", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {
            return res.status(401).json({
                message: "Authentication required."
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || "campusconnect_secret"
        );

        const {
            reportType,
            category,
            itemName,
            location,
            date,
            description
        } = req.body;

        if (
            !reportType ||
            !category ||
            !itemName ||
            !location ||
            !date ||
            !description
        ) {
            return res.status(400).json({
                message: "All fields are required."
            });
        }

        const report = new LostFound({
            reportType,
            category,
            itemName,
            location,
            date,
            description,
            reportedBy: decoded.userId
        });

        await report.save();

        res.status(201).json({
            message: "Lost & Found report submitted successfully.",
            report
        });

    } catch (error) {
        console.error(
            "Create Lost & Found Error:",
            error
        );

        if (
            error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError"
        ) {
            return res.status(401).json({
                message: "Invalid or expired token."
            });
        }

        res.status(500).json({
            message:
                "Server error while submitting Lost & Found report."
        });
    }
});


// =====================================================
// ALL LOST & FOUND - STAFF
// =====================================================

app.get("/api/lost-found", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {
            return res.status(401).json({
                message: "Authentication required."
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || "campusconnect_secret"
        );

        if (
            decoded.accountType !== "Staff" &&
            decoded.accountType !== "staff"
        ) {
            return res.status(403).json({
                message: "Staff access required."
            });
        }

        const reports = await LostFound.find()
            .populate(
                "reportedBy",
                "fullName email collegeId accountType"
            )
            .sort({ createdAt: -1 });

        res.status(200).json({
            reports
        });

    } catch (error) {
        console.error(
            "Get Lost & Found Error:",
            error
        );

        if (
            error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError"
        ) {
            return res.status(401).json({
                message: "Invalid or expired token."
            });
        }

        res.status(500).json({
            message:
                "Server error while fetching Lost & Found reports."
        });
    }
});


// =====================================================
// MY LOST & FOUND REPORTS
// =====================================================

app.get("/api/lost-found/my", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {
            return res.status(401).json({
                message: "Authentication required."
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || "campusconnect_secret"
        );

        const reports = await LostFound.find({
            reportedBy: decoded.userId
        })
            .populate(
                "reportedBy",
                "fullName email collegeId accountType"
            )
            .sort({ createdAt: -1 });

        res.status(200).json({
            reports
        });

    } catch (error) {
        console.error(
            "Get My Lost & Found Error:",
            error
        );

        if (
            error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError"
        ) {
            return res.status(401).json({
                message: "Invalid or expired token."
            });
        }

        res.status(500).json({
            message:
                "Server error while fetching your Lost & Found reports."
        });
    }
});


// =====================================================
// UPDATE LOST & FOUND STATUS - STAFF ONLY
// =====================================================

app.patch(
    "/api/lost-found/:id/status",
    async (req, res) => {
        try {
            const authHeader =
                req.headers.authorization;

            if (
                !authHeader ||
                !authHeader.startsWith("Bearer ")
            ) {
                return res.status(401).json({
                    message: "Authentication required."
                });
            }

            const token =
                authHeader.split(" ")[1];

            const decoded = jwt.verify(
                token,
                process.env.JWT_SECRET ||
                    "campusconnect_secret"
            );

            if (
                decoded.accountType !== "Staff" &&
                decoded.accountType !== "staff"
            ) {
                return res.status(403).json({
                    message: "Staff access required."
                });
            }

            const {
                status
            } = req.body;

            const allowedStatuses = [
                "Active",
                "Matched",
                "Resolved"
            ];

            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({
                    message:
                        "Invalid status. Allowed values: Active, Matched, Resolved."
                });
            }

            const updatedReport =
                await LostFound.findByIdAndUpdate(
                    req.params.id,
                    {
                        status
                    },
                    {
                        new: true,
                        runValidators: true
                    }
                ).populate(
                    "reportedBy",
                    "fullName email collegeId accountType"
                );

            if (!updatedReport) {
                return res.status(404).json({
                    message:
                        "Lost & Found report not found."
                });
            }

            res.status(200).json({
                message:
                    "Lost & Found status updated successfully.",
                report: updatedReport
            });

        } catch (error) {
            console.error(
                "Update Lost & Found Status Error:",
                error
            );

            if (error.name === "CastError") {
                return res.status(400).json({
                    message:
                        "Invalid Lost & Found report ID."
                });
            }

            if (
                error.name === "JsonWebTokenError" ||
                error.name === "TokenExpiredError"
            ) {
                return res.status(401).json({
                    message:
                        "Invalid or expired token."
                });
            }

            res.status(500).json({
                message:
                    "Server error while updating Lost & Found status."
            });
        }
    }
);


// =====================================================
// GET PROFILE
// =====================================================

app.get("/api/profile", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {
            return res.status(401).json({
                message: "Authentication required."
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET ||
                "campusconnect_secret"
        );

        const user = await User.findById(
            decoded.userId
        ).select("-password");

        if (!user) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        res.status(200).json({
            user
        });

    } catch (error) {
        console.error(
            "Get Profile Error:",
            error
        );

        if (
            error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError"
        ) {
            return res.status(401).json({
                message:
                    "Invalid or expired token."
            });
        }

        res.status(500).json({
            message:
                "Server error while fetching profile."
        });
    }
});


// =====================================================
// UPDATE PROFILE
// =====================================================

app.patch("/api/profile", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {
            return res.status(401).json({
                message: "Authentication required."
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET ||
                "campusconnect_secret"
        );

        const {
            fullName
        } = req.body;

        if (
            !fullName ||
            !fullName.trim()
        ) {
            return res.status(400).json({
                message:
                    "Full name is required."
            });
        }

        const user =
            await User.findByIdAndUpdate(
                decoded.userId,
                {
                    fullName:
                        fullName.trim()
                },
                {
                    new: true,
                    runValidators: true
                }
            ).select("-password");

        if (!user) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        res.status(200).json({
            message:
                "Profile updated successfully.",
            user
        });

    } catch (error) {
        console.error(
            "Update Profile Error:",
            error
        );

        if (
            error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError"
        ) {
            return res.status(401).json({
                message:
                    "Invalid or expired token."
            });
        }

        res.status(500).json({
            message:
                "Server error while updating profile."
        });
    }
});


// =====================================================
// MONGODB CONNECTION
// =====================================================

// Server ko pehle start karo taaki Deployment Platform (Railway/Render) ka Health Check pass ho jaye
// Railway dynamic PORT variable ko priority deta hai
const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});

if (process.env.MONGODB_URI) {
    mongoose
        .connect(process.env.MONGODB_URI)
        .then(() => {
            console.log("MongoDB Connected Successfully!");
        })
        .catch((error) => {
            console.error("MongoDB Connection Error:", error);
        });
} else {
    console.warn("MONGODB_URI is not defined in environment variables.");
}