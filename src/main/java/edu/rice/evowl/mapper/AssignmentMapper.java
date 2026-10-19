package edu.rice.evowl.mapper;

import edu.rice.evowl.entity.Assignment;
import java.util.List;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface AssignmentMapper {
  @Select("SELECT * from assignment")
  List<Assignment> getAllAssignments();

  @Select(
    "SELECT pairs_per_student FROM assignment WHERE assignment_id = #{assignment_id}"
  )
  Integer getPairsPerStudentById(@Param("assignment_id") Integer assignment_id);

  @Select(
    "SELECT evals_per_ta_per_criteria FROM assignment WHERE assignment_id = #{assignment_id}"
  )
  Integer getEvalsPerTaPerCriteria(
    @Param("assignment_id") Integer assignment_id
  );
}
