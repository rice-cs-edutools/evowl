package edu.rice.evowl.util;

import edu.rice.evowl.entity.DynamicPeerEvalSubmission;
import org.apache.ibatis.jdbc.SQL;

public class PeerEvalSubmissionSqlProvider {

  public String insertDynamic(
    DynamicPeerEvalSubmission dynamicPeerEvalSubmission
  ) {
    String command = new SQL() {
      {
        String sub = dynamicPeerEvalSubmission.getSubmission_id2();
        int assignId = Integer.parseInt(sub.split("-")[0]);

        System.out.println(assignId);
        INSERT_INTO("peer_eval_submission_" + assignId);

        VALUES("submission_id1", "#{submission_id1}");
        VALUES("submission_id2", "#{submission_id2}");
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
        FROM("peer_eval_submission_" + assignId);
      }
    }
      .toString();

    System.out.println("select command: " + command);
    return command;
  }
}
