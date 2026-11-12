CREATE TABLE IF NOT EXISTS vehicle_models (
  id          int(11)      NOT NULL AUTO_INCREMENT,
  name        varchar(100) NOT NULL,
  consumption decimal(5,2) NOT NULL,
  status      tinyint(4)   DEFAULT 1,
  created_at  timestamp    NOT NULL DEFAULT current_timestamp(),
  updated_at  timestamp    NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY name (name)
);
