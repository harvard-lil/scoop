from flask import Flask, request
from datetime import datetime
from wacz_signing import signer


app = Flask(__name__)

@app.post('/sign')
def sign():
    data = request.get_json()

    try:
        dt = datetime.strptime(data['created'], "%Y-%m-%dT%H:%M:%S.%fZ")
    except ValueError:
        dt = datetime.strptime(data['created'], "%Y-%m-%dT%H:%M:%SZ")
    
    try:
        result = signer.sign(
            data['hash'],
            dt
        )
    except signer.SigningException as e:
        return {
            "error": str(e)
        }

    return {
        k: v.decode("utf-8")
        if type(v) is bytes
        else str(v)
        for k, v in result.items()
    }
