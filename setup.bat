cd /d C:
git config --global user.name "Orchids International"
git config --global user.email "test@test.com"
gh auth login --with-token < token.txt
gh auth status


echo Creating folder '1' in Downloads and initializing git.


if not exist "C:\Users\K12\Downloads\1" (
    mkdir "C:\Users\K12\Downloads\1"
)


cd /d "C:\Users\K12\Downloads\1"


git init
echo First Test > README.md
git add README.md
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/CodingSmiles/work_files.git
git push -u origin main

endlocal
