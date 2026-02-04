commands to setup db
1. mysql -u root -p
2. CREATE DATABASE hirelawyer;

create tables
3. mysql -u root -p hirelawyer < schema.sql

seed dummy data
4. mysql -u root -p hirelawyer < seed_dummy_data.sql
