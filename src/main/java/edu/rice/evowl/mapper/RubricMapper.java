package edu.rice.evowl.mapper;

import java.util.List;
import java.util.Map;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

public interface RubricMapper {
  @Select(
    "SELECT headers, deduction_text, deduction_pts, mutually_exclusive FROM rubric WHERE assignment_id = #{assignment_id} AND criteria_id = #{criteria_id}"
  )
  @Results(
    id = "rubricResultMap",
    value = {
      @Result(property = "headers", column = "headers"),
      @Result(property = "deductionText", column = "deduction_text"),
      @Result(property = "deductionPts", column = "deduction_pts"),
      @Result(property = "mutuallyExclusive", column = "mutually_exclusive"),
    }
  )
  List<Map<String, Object>> getRubricFormatById(
    @Param("assignment_id") Long assignment_id,
    @Param("criteria_id") Long criteria_id
  );
}
