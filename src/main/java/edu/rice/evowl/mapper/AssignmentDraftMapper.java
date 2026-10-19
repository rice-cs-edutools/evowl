package edu.rice.evowl.mapper;

import edu.rice.evowl.entity.AssignmentDraft;
import java.util.List;
import org.apache.ibatis.annotations.*;

public interface AssignmentDraftMapper {
  @Select("SELECT * from assignment_draft")
  List<AssignmentDraft> getAllAssignmentDrafts();

  @Insert("REPLACE INTO assignment_draft(draft_id, json) VALUES(#{draft_id}, #{json})")
  void updateDraft(AssignmentDraft assignmentDraft);

  @Insert("INSERT INTO assignment_draft(json) VALUES(#{json})")
  @Options(useGeneratedKeys = true, keyProperty = "draft_id")
  void insertDraft(AssignmentDraft assignmentDraft);

  @Update(
    "CREATE TABLE IF NOT EXISTS assignment_draft (" +
    "  draft_id INT NOT NULL AUTO_INCREMENT," +
    "  json mediumtext NOT NULL," +
    "  PRIMARY KEY (draft_id)," +
    "  UNIQUE KEY draft_id_UNIQUE (draft_id)" +
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci"
  )
  void createTableIfNeeded();
}
