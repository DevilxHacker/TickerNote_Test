import React from "react";

const PythonConnectionTest = () => {

    const testConnection = async () => {

        try {

            const res = await fetch(
                "http://localhost:5000/api/hello-python",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        message: "Hi from React",
                    }),
                }
            );

            const data = await res.json();

            console.log("Response:", data);

            alert(data.reply);

        } catch (error) {

            console.log(error);

            alert("Connection Failed");
        }
    };

    return (
        <div style={{ padding: "20px" }}>
            <h2>Python Connection Test</h2>

            <button onClick={testConnection}>
                Test Python Connection
            </button>
        </div>
    );
};

export default PythonConnectionTest;