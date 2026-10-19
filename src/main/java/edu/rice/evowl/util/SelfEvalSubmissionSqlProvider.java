package edu.rice.evowl.util;

import edu.rice.evowl.entity.DynamicSelfEvalSubmission;
import org.apache.ibatis.jdbc.SQL;

public class SelfEvalSubmissionSqlProvider {

  public String insertDynamic(
    DynamicSelfEvalSubmission dynamicSelfEvalSubmission
  ) {
    String command = new SQL() {
      {
        String sub = dynamicSelfEvalSubmission.getSubmission_id();
        int assignId = Integer.parseInt(sub.split("-")[0]);

        System.out.println(assignId);
        INSERT_INTO("self_eval_submission_" + assignId);

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

  public String selectAllFromAssignment(long assignId) {
    String command = new SQL() {
      {
        SELECT("*");
        FROM("self_eval_submission_" + assignId);
      }
    }
      .toString();

    System.out.println("select command: " + command);
    return command;
  }
}
