package edu.rice.evowl.util;

import edu.rice.evowl.entity.TrainingSubmission;
import org.apache.ibatis.jdbc.SQL;

public class TrainingSubmissionSqlProvider {

  public String insertDynamic(TrainingSubmission trainingSubmission) {
    String command = new SQL() {
      {
        INSERT_INTO("training_submission_" + trainingSubmission.getAssign_id());
        VALUES("submission_id", "#{submission_id}");
        VALUES("unique_id", "#{unique_id}");
        VALUES("submit_time", "#{submit_time}");
        VALUES("choices", "#{choices}");
        VALUES("free_responses", "#{free_responses}");
      }
    }
      .toString();
    command = command.replaceAll("INSERT INTO", "INSERT IGNORE INTO");
    System.out.println("insert command: " + command);
    return command;
  }
}
