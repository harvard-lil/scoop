To test Scoop's signing features against a locally-running signing service: 
- Install [mkcert](https://github.com/FiloSottile/mkcert) 
- Then, in this directory, run `bash ./run.sh`

(An equivalent is `npm run dev-signer`. Note that this will overwrite the top-level `.env`.)

To maintain `requirements.txt`, we use [Poetry](https://python-poetry.org/), hence the presence of `pyproject.toml` and `poetry.lock`; to update a package, run something like

```
poetry update requests
poetry export -o requirements.txt
```

and commit the changes.
