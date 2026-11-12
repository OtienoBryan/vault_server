CREATE TABLE IF NOT EXISTS vehicles (
  id                  int(11)      NOT NULL AUTO_INCREMENT,
  registration_number varchar(20)  NOT NULL,
  model_id            int(11)      NOT NULL,
  consumption         decimal(5,2) NOT NULL,
  status              tinyint(4)   DEFAULT 1,
  created_at          timestamp    NOT NULL DEFAULT current_timestamp(),
  updated_at          timestamp    NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY registration_number (registration_number),
  KEY model_id (model_id),
  CONSTRAINT fk_vehicles_model FOREIGN KEY (model_id) REFERENCES vehicle_models (id)
);
